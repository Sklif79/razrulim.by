'use script';

window.iCracked = {};

String.prototype.ucfirst = function() {
	return this.replace(/\w\S*/g, function(text) {
		return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
	});
}

// Thanks to o-o @ StackOverflow Q#3066586
Date.prototype.yyyymmdd = function() {
	var yyyy = this.getFullYear().toString();
	var mm = (this.getMonth()+1).toString(); // getMonth() is zero-based
	var dd  = this.getDate().toString();
	return yyyy + (mm[1]?mm:"0"+mm[0]) + (dd[1]?dd:"0"+dd[0]); // padding
};

iCracked.init = function(opts) {
	var _internal = {
		'defaults': {
			'developer': false,
			'logLevel': 5,
			'siteUrl': 'https://www.icracked.com',
			'APIUrl': 'https://www.icracked.com/api'
		}
	};

	var o = $.extend({}, _internal.defaults, opts);
	iCracked.user = opts.user ? opts.user : false;

	iCracked.mapCount = 0;
	iCracked.maps = [];

	iCracked.log.init(o.logLevel);
	iCracked.API.init(o.APIUrl);

	iCracked.options = o;
	iCracked.initialized.resolve()
};

iCracked.makeAddressButtons = function(types) {
	var typeColors = {addrDefault: 'success', addrBusiness: '', addrDelete: 'alert'};
	var typeText = {addrDefault: 'Set as Default', addrBusiness: 'Set as Business', addrDelete: 'remove'};
	var html = '<td class="right">';
	types.forEach(function(type) {
		html += ' <a href="#" class="'+type+' button '+typeColors[type]+'">'+typeText[type]+'</a> '
	});
	html += '</td>';
	return html;
}

iCracked.log = {
	noop: function() {},
	log: this.noop,
	init: function(level) {
		this.log_level = level - 1;
		this.levels = ['error', 'warn', 'info', 'trace'];

		this.log = function(msg) {
			if (typeof console.log == 'function') {
				console.log(msg);
			} else {
				alert('Developer mode requires a browser with a console');
			}
		};

		for (var i = 0; i < this.levels.length; i++) {
			var methodName = this.levels[i];

			if (this.log_level >= i) {
				(function(that, method) {
					that[method] = function(msg) {
						that.log(method + ' >> ' + msg);
					}
				})(this, methodName);
			} else {
				(function(that, method) {
					that[method] = that.noop;
				})(this, methodName);
			}
		}
	}
};

iCracked.deParam = function () {
	var vars = {};
	window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function (m, key, value) {
	    vars[key] = decodeURIComponent(value);
	});
	return vars;
};

iCracked.initialized = $.Deferred();
iCracked.ready = function(e) {
	iCracked.initialized.done(e)
};

iCracked.ready(function() {
	var $gaClientIds = $('input[name="gaClientId"]');

	if ($gaClientIds.length) {
		$gaClientIds.val(gaClientId);
	}

	$('.locale-dropdown').on('change', function(e) {
		var url = $(this).val();
		if (url.length) {
			window.location.href = url;
		}
	});

	$('.map').each(function() {
		var obj = $(this),
				mapper = new iCracked.mapper(),
				map = mapper.getMap(),
				markerContainer =  obj.find('.markers');

		mapper.init(this, {
			'zoom': obj.data('zoom'),
			'center': [
				obj.data('center-lat'),
				obj.data('center-long')
			]
		});

		if (obj.data('static') !== undefined) {
			mapper.setStatic();
		}

		if (markerContainer.length) {
			var markers = $.parseJSON(markerContainer.val());
			$.each(markers, function(i, data) {
				mapper.addMarker(data.latitude, data.longitude, data.title, data.description, data.size, data.color, data.symbol);
			});
		}

		var map = mapper.getMap();

		if (obj.data('pin-center')) {
			mapper.addMarker(obj.data('center-lat'), obj.data('center-long'), obj.data('pin-title'), obj.data('pin-description'));
		}

		$(this).on('resize', function() {
			map.invalidateSize();
		});
	});

	$('*[data-countdown]').each(function() {
		var seconds  = $(this).data('countdown'),
			el         = $(this);

		if (seconds <= 0) {
			return;
		}

		var units = {
			'week':   7 * 86400,
			'day':    86400,
			'hour':   3600,
			'minute': 60,
			'second': 1
		};

		var timer = setInterval(function() {
			var string = '';
			if (--seconds) {
				var tmpSeconds = seconds;

				for (var i = 0; i < 5; i++) {
					var unit    = Object.keys(units)[i],
							divisor = units[unit];
							quot = 0;

					if (quot = (parseInt(tmpSeconds / divisor))) {
						string += quot + ' ' + unit + (Math.abs(quot) > 1 ? 's' : '') + ', ';
						tmpSeconds -= quot * divisor;
					}
				}

				el.text(string.substring(0, string.length - 2));
			} else {
				clearInterval(timer);
			}
		}, 1000);
	});

	$('.icracked-uploader').each(function() {
		var obj = $(this);
		var uploader = new iCracked.uploader();
		uploader.init(obj);
	});

	$('#profileImageUpload').on('change', 'input[type=file]', function() {
		if (this.id == 'profileFirstImage') {
			$(this).parents('form').find('input[type=submit]').removeAttr('disabled');
		}
	});

	if (iCracked.user === false) {
		$('form[name=loginForm]').on('submit', function(e) {
			var userField = $(this).find('input[name=email]'),
						passField = $(this).find('input[name=password]'),
						errField  = $(this).find('.errContainer small');

			var username = userField.val();
				password = passField.val();

			errField.removeClass('error').text('');
			userField.removeClass('error');
			passField.removeClass('error');

			iCracked.authenticate(username, password, function(user) {
				// If they're an iTech, always send them to user, otherwise send them to their redirect
				// Customer portal will make all of this irrelevant
				if (user.tech && user.is_tech_active) {
					window.location.href = '/user';
				} else {
					window.location.href = iCracked.deParam().redirect || '/user';
				}
			}, function(error) {
				userField.addClass('error');
				passField.addClass('error');

				var errorMessage = 'An error occurred, please try again later';
				if (error == 404) {
					errorMessage = 'Invalid username/password combination';
				}

				errField.text(errorMessage).addClass('error');
			});

			e.preventDefault();
		});
	}

	$('.country-list').on('change', function() {
		var countryID = this.value;
		iCracked.log.trace('Loading provinces for: ' + countryID);

		if ($(this).data('for') != undefined) {
			var provincesList = $('#' + $(this).data('for'));
			if (provincesList.length) {
				provincesList.children('option:not(:first)').remove();

				iCracked.API.get('geo/provinces/' + countryID, {}, function(response) {
					switch(response.status) {
						case 200:
							if (!provincesList.is(':visible'))
								provincesList.fadeIn();

							var provinces = response.responseJSON.provinces;

							$.each(provinces, function(i, item) {
								provincesList.append(
									$('<option>').val(item.id).text(item.name)
								);
							});
							break;
						case 204:
							provincesList.fadeOut();
							break;
					}
				});
			} else {
				iCracked.log.warn('Invalid for attribute set for country-list');
			}
		} else {
			iCracked.log.warn('No for attribute set for country-list');
		}
	});

	$('.zip.autoFill').on('keyup', function() {
		if (this.value.length < 5)
			return;

		var that = $(this);

		if (that.data('province') != undefined || that.data('city') != "undefined") {
			iCracked.API.get('geo/zip/' + this.value, {}, function(response) {
				switch (response.status) {
					case 200:
						var info = response.responseJSON.info;

						var countryList  = $('#' + that.data('country'));
						var provinceList = $('#' + that.data('province'));
						var cityField = $('#' + that.data('city'));

						// Only US right now
						countryList.find('option:contains("United States"):first').prop('selected', true);
						cityField.val(info.city.ucfirst());

						var targetProvince = provinceList.find('option[value="' + info.province_id + '"]');

						if (targetProvince.length) {
							targetProvince.prop('selected', true);
						} else {
							provinceList.children('option:not(:first)').remove();
							provinceList.append(
								$('<option>').val(info.province_id).text(info.province)
							);
							provinceList.find('option:eq(1)').prop('selected', true);
						}

						break;
					case 204:

						break;
				}
			});
		}
	});


	$('form[name=aboutYouForm]').on('submit', function(e) {
		var firstName = $(this).find('input[name="first_name"]'),
			lastName  = $(this).find('input[name="last_name"]'),
			cellPhone = $(this).find('input[name="phone"]'),
			about	  = $(this).find('textarea[name="about"]'),
			quote	  = $(this).find('textarea[name="quote"]'),
			interests = $(this).find('textarea[name="interests"]'),
			languages = $(this).find('input[name="languages"]'),
			gender    = $(this).find('select[name="gender"]'),
			msgField  = $(this).find('.msgContainer small'),
			day = $(this).find('select[name="day"] option:selected').val(),
			month = $(this).find('select[name="month"] option:selected').val()-1, // month is zero based
			year = $(this).find('select[name="year"] option:selected').val(),
			birthday = new Date(year, month, day),
			em_type   = $(this).find('select[name="em_type"]'),
			em_first_name = $(this).find('input[name="em_first_name"]'),
			em_last_name   = $(this).find('input[name="em_last_name"]'),
			em_phone   = $(this).find('input[name="em_phone"]'),
			area_code = $(this).find('input[name="area_code"]'),
			primary_zip = $(this).find('input[name="primary_zip"]'),
			nearby_zips = $(this).find('input[name="nearby_zips"]');


		msgField.removeClass('error').removeClass('success').text('').show();
		iCracked.API.post('customer/' + iCracked.user.id + '/update',
			{
				'first_name': firstName.val(),
				'last_name': lastName.val(),
				'phone': cellPhone.val(),
				'gender': gender.find('option:selected').val(),
				'birthday': birthday.yyyymmdd(),
				'about': about.val(),
				'quote': quote.val(),
				'languages': languages.val(),
				'interests': interests.val(),
				'em_type': em_type.val(),
				'em_first_name': em_first_name.val(),
				'em_last_name': em_last_name.val(),
				'em_phone': em_phone.val(),
				'area_code': area_code.val(),
				'primary_zip': primary_zip.val(),
				'nearby_zips': nearby_zips.val()

		}, function(response) {
			if (response.status == 200) {
				msgField.addClass('success').text('Success!');
			} else {
				msgField.addClass('error').text('Error');
			}

			setTimeout(function() {
				msgField.fadeOut();
			}, 2000);
		});

		e.preventDefault();
	});

	$('table.addressList.editable').on('click', ' .addrDefault', function(e) {
		var table = $(this).closest('table');
		var row = $(this).parents('tr');
		var addressID = row.data('id');
		var newDefaultRow = row.clone().attr('id', 'defaultAddressRow');
		newDefaultRow.find('.right').remove();
		newDefaultRow.append(iCracked.makeAddressButtons(['addrBusiness']));

		var oldDefaultRow = $('#defaultAddressRow').clone()
		oldDefaultRow.find('.right').remove();
		oldDefaultRow.append(iCracked.makeAddressButtons(['addrDefault', 'addrBusiness','addrDelete']));

		iCracked.API.post('customer/' + iCracked.user.id + '/updateDefaultAddress/' + addressID, {'is_default' : '1'}, function(response) {
			switch (response.status) {
				case 202:
					$('#defaultAddressRow').remove();
					$('#defaultAddressTable').append(newDefaultRow);
					if (addressID !== $('#businessAddressRow').data('id')) { 
						row.remove(); 
					}
					if (oldDefaultRow.data('id') !== $('#businessAddressRow').data('id')) { 
						$('#otherAddressTable').append(oldDefaultRow);
					}
					newDefaultRow.addClass('updatedRow');
					break;
				case 304:
					//row.fadeOut(function() { $(this).remove(); });
					break;
			}
		});

		 e.preventDefault();
	 });

	$('table.addressList.editable').on('click', ' .addrBusiness', function(e) {
		var table = $(this).closest('table');
		var row = $(this).parents('tr');
		var addressID = row.data('id');
		var newBusinessRow = row.clone().attr('id', 'businessAddressRow');
		newBusinessRow.find('.right').remove();
		newBusinessRow.append(iCracked.makeAddressButtons(['addrDefault']));
		
		var oldBusinessRow = $('#businessAddressRow').clone()
		oldBusinessRow.find('.right').remove();
		oldBusinessRow.append(iCracked.makeAddressButtons(['addrDefault', 'addrBusiness','addrDelete']));

		iCracked.API.post('customer/' + iCracked.user.id + '/updateLegalEntityAddress/' + addressID, {'is_legal_entity' : '1'}, function(response) {
			switch (response.status) {
				case 202:
					$('#businessAddressRow').remove();
					$('#businessAddressTable').append(newBusinessRow);
					if (addressID !== $('#defaultAddressRow').data('id')) { 
						row.remove(); 
					}
					if (oldBusinessRow.data('id') !== $('#defaultAddressRow').data('id')) { 
						$('#otherAddressTable').append(oldBusinessRow);
					}
					newBusinessRow.addClass('updatedRow');
					break;
				case 304:
					//row.fadeOut(function() { $(this).remove(); });
					break;
			}
		});
		e.preventDefault();
	 });

	$('table.addressList.editable').on('click', '.addrDelete', function(e) {
		var row = $(this).parents('tr');
		var addressID = row.data('id');

		iCracked.API.delete('customer/' + iCracked.user.id + '/address/' + addressID, {}, function(response) {
			switch (response.status) {
				case 200:
					row.fadeOut(function() { $(this).remove(); });
					break;
				case 404:
					row.fadeOut(function() { $(this).remove(); });
					break;
				case 503:
					//TODO Handle correctly
					break;
			}
		});

		e.preventDefault();
	});

	$('.birthdayFields select[name=year], .birthdayFields select[name=month]').on('change', function() {
		var days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31],
			row  = $(this).parents('.row:first');
			month = row.find('select[name="month"]').val() - 1,
			year  = row.find('select[name="year"]').val(),
			dayField = row.find('select[name="day"]');
			count = dayField.find('option').length;

			if (month == 1 && ((year%400 == 0) || (year%100 != 0 && year%4 == 0))) {
				days[month]++;
			}

			if (count > days[month]) {
				dayField.find('option').slice(days[month]).remove();
			} else if (count < days[month]) {
				for (;count++ < days[month];) {
					dayField.append($('<option />').val(count).text(count));
				}
			}
	});

	$('.newAddressForm').on('submit', function(e) {
		var firstName = $(this).find('input[name="first_name"]'),
			lastName = $(this).find('input[name="last_name"]'),
			address1 = $(this).find('input[name="address1"]'),
			address2 = $(this).find('input[name="address2"]'),
			zip = $(this).find('input[name="zip"]'),
			city = $(this).find('input[name="city"]'),
			country = $(this).find('select[name="country_id"]'),
			province = $(this).find('select[name="province_id"]'),
			defaultAddr = $(this).find('input[name="defaultAddress"]'),
			businessAddr = $(this).find('input[name="businessAddress"]'),
			msgField = $(this).find('.msgContainer small'),
			_ = $(this);

		_.find('.error').removeClass('error').off('keyup.errorCheck');
		msgField.text('');

		iCracked.API.put('customer/' + iCracked.user.id + '/address', {
			'first_name': firstName.val(),
			'last_name': lastName.val(),
			'address1': address1.val(),
			'address2': address2.val(),
			'zip': zip.val(),
			'city': city.val(),
			'country_id': country.find('option:selected').val(),
			'province_id': province.find('option:selected').val(),
			'default': defaultAddr.is(':checked'),
			'is_legal_entity': businessAddr.is(':checked')
		}, function(response) {

			if (response.responseJSON && response.responseJSON.errors) {
				var errors = response.responseJSON.errors;
				msgField.addClass('error');

				var errHTML = '';
				for (var key in errors) {
					if (errors.hasOwnProperty(key)) {

						var field = _.find('input[name="' + key + '"], select[name="' + key + '"]'),
							error = errors[key];

						if (field.length) {
							field.addClass('error');
							field.on('keyup.errorCheck', function(e) {
								$(this).removeClass('error')
										 .off('keyup.errorCheck');
							});
						}

						errHTML = errHTML + error + '<br>';
					}
				}

				msgField.html(errHTML);
			}

			switch (response.status) {
				case 201:
					var address = response.responseJSON.address.data;
					var addressID = response.responseJSON.address.id;

					if (address.is_default == 1) {
						var defaultHtml = "<b>Default &nbsp;&nbsp;&nbsp;</b>";
					} else {
						var defaultHtml = '<a href="#" class="addrDefault button success">Set as Default</a>';
					}

					var addressLine = address.first_name + ' ' + address.last_name + '<br />' +
										address.address1 + ' ' + address.address2 + '<br />' +
										address.city + '<br />' +
										address.zip;

						$('<tr>').hide().data('id', addressID)
							 .append($('<td>').html(addressLine))
							 .append($('<td>').addClass('right').html(
								defaultHtml + '<a href="#" class="addrDelete button alert">remove</a>'
							 )).prependTo('table.addressList tbody').fadeIn();

						address1.val('');
						address2.val('');
						zip.val('');
						city.val('');
						province.find('option:selected').prop('selected', '');
						defaultAddr.prop('checked', '');

						msgField.addClass('success').text('Success!');
						location.reload();
						setTimeout(function() {
						msgField.fadeOut();
					}, 2000);
				break;
			}
		});

		e.preventDefault();
	});

	$('form[name="changePassword"]').on('submit', function(e) {
		var oldPassword  = $(this).find('input[name="password"]'),
				newPassword  = $(this).find('input[name="new_password"]'),
				cNewPassword = $(this).find('input[name="cnew_password"]'),
			msgField  = $(this).find('.msgContainer small');

		oldPassword.removeClass('error');
		newPassword.removeClass('error');
		cNewPassword.removeClass('error');
		msgField.text('').removeClass('error').removeClass('success').show();;

		iCracked.API.post('customer/' + iCracked.user.id + '/password',
			{
				'old_password': oldPassword.val(),
				'new_password': newPassword.val(),
				'confirmation': cNewPassword.val()
			}, function(response) {
				if (response.responseJSON && response.responseJSON.error) {
					msgField.text(response.responseJSON.error).addClass('error');
				}

				switch (response.status) {
					case 200:
						oldPassword.val('');
						newPassword.val('');
						cNewPassword.val('');

						msgField.addClass('success').text('Success!');
						break;
					case 404:
						oldPassword.val('').addClass('error');
						break;
					case 409:
						newPassword.val('').addClass('error');
						cNewPassword.val('').addClass('error');

						break;
				}

				setTimeout(function() {
					msgField.fadeOut();
				}, 2000);
			}
		);

		e.preventDefault();
	});

	$('.steps ul.inline-list li a').on('click', function(e) {
		if ($(this).find('.active').length)
			return false;

		var panel = $(this).parent(),
			idx   = panel.index();

		$('.steps ul.inline-list li div.active').removeClass('active');
		$(this).parents('ul').children().eq(idx).find('div:first').addClass('active');

		$('.row.step:visible').fadeOut(function() {
			$('.row.step').eq(idx).fadeIn(function() {
				if (idx == 1) {
					$('.map').trigger('resize');
				}
			});
		});

		e.preventDefault();
	});

	$('.application-download-url').on('click', function(e) {
		var appID = $(this).data('app-id');
		var that = $(this);

		if (that.data('sent')) {
			alert('The link was already sent!');
			return false;
		}

		iCracked.API.get('itech/' + iCracked.user.id + '/application/' + appID, {}, function(response) {
			if (response.status == 200) {
				that.text('Sent!');
				that.data('sent', true);
			} else {
				that.text('Failed!');
			}
		});

		e.preventDefault();
	});

	$('#balancedAccounts .delete').on('click', function(e) {
		var balancedID = $(this).parents('tr').data('id'),
			that = $(this);

		iCracked.API.delete('itech/' + iCracked.user.id + '/balancedAccount/' + balancedID, {}, function(response) {
			if (response.status == 200) {
				that.parents('tr').fadeOut(function() { $(this).remove(); });
			} else {
				that.text('Failed!');
			}
		});
	});

	$('.buybackPayment input[name=paymentMethod]').on('change', function(e) {
		var paymentID = $(this).val(),
			that = $(this);

		iCracked.log.trace('Updating payment method to : ' + paymentID);
		iCracked.API.post('itech/' + iCracked.user.id + '/paymentMethod', {
			paymentID: paymentID
		}, function(response) {
			if (response.status != 200) {
				iCracked.log.error('Failed to update payment method');
			}
		});
	});

	$('.expressRMALabel').on('click', function(e) {
		var buybackID = $(this).parents('tr').data('buyback'),
			that = $(this);

		if (that.data('sent') == true) {
			that.text('Already sent!');
			return false;
		}

		that.text('sending...');

		iCracked.API.post('buyback/' + buybackID + '/rmaLabel', {}, function(response) {
			if (response.status == 201) {
				that.text('sent!').data('sent', true);
			} else {
				that.text('failed to send!');
			}
		});

		e.preventDefault();
	});

	$('#repair_information').on('submit', function(e) {
		var input = $(this).find('input[type=submit]');
		if (input.hasClass('disabled')) {
			return false;
		}

		$(this).on('valid', function () {
			input.val('Contacting your local iTechs...').addClass('disabled').css('width', '100%');
		});
	});

	$("#privacyLink").click(function(e) {
		$(this).hide();
		$("#privacyInfo").fadeIn();
		e.preventDefault();
	});

	$('#itechDevices .delete').on('click', function(e) {
		var deviceID = $(this).parents('tr').data('id'),
			that = $(this);

		iCracked.API.delete('itech/' + iCracked.user.id + '/devices/' + deviceID, {}, function(response) {
			if (response.status == 200) {
				that.parents('tr').fadeOut(function() {
					$(this).remove();
				});
			} else {
				that.text('Failed!');
			}
		});
	});

	$('#addl-notes-btn').on('click', function(){
		if ($('#addl-notes').val().length > 5) {
			var values = {
				'note': $('#addl-notes').val()
			};
			iCracked.API.post('dispatch/'+ $(this).data('dispatch-uid') +'/notes/', values, function(response) {
				if (response.status == 201) {
					$('.dispatch-addl-notes-success').show();
					$('.information-module').hide();
				}
			});
		}
	});
	/**
	 * Generates marketing materials for an iTech and downloads
	 * to the browser
	 * Forgive me, Front-End, for I have sinned.
	 */
	$('#language-select').on('change', function() {
		if (this.value === '') {
			$('#marketing-materials').prop('disabled', true)
			.addClass('disabled');
		} else {
			$('#marketing-materials').prop('disabled', false)
			.removeClass('disabled');
		}
	});
	$('#marketing-materials').on('click', function() {
		$('.success-message').hide();
		$('.form-error').hide();
		var $this = $(this);
		$this.prop('disabled', true).addClass('disabled');
		$this.val('Generating');

		// Because loading dots are cool
		var dots = window.setInterval(function() {
			var wait = $this.val();
			if (wait.length > 12) {
				$this.val('Generating');
			} else {
				$this.val(wait += '.');
			}
		}, 300);

		var language = document.getElementById('language-select').value;

		iCracked.API.post('marketing/generateMaterialsForItech',
			{language: language}, function(response) {
			var errorMsg;
			$this.show();
			clearInterval(dots);
			$this.val('Generate Materials')
			$this.prop('disabled', false).removeClass('disabled');
			response = response.responseJSON;
			switch (response.status) {
				case 200:
					$('.success-message').show().delay(5000).fadeOut();
					window.location = response.zip_url;
					break;
				case 400:
					switch (response.error) {
						case 'Language is required':
							errorMsg = 'Please select a language.';
							break;
						case 'Email not set':
							errorMsg = 'Please set your default email.';
							break;
						case 'Phone not set':
							errorMsg = 'Please set your default phone number.';
							break;
						case 'Method not allowed':
						case 'Unauthorized':
						case 'Request failed. Please try again.':
							errorMsg = 'Something went wrong! Please contact HQ!';
							break;
						default:
							errorMsg = response.error;
							break;
					}
					$('.form-error').text(errorMsg).show().delay(5000).fadeOut();
					break;
				default:
					msg = 'Something went wrong! Please contact HQ!';
					$('.form-error').text(msg).show().delay(5000).fadeOut(5000);
					break;
			}
		});
	});
});

iCracked.logout = function() {
	iCracked.log.info('Logout called');
}

iCracked.authenticate = function(username, password, successCallback, errorCallback) {
	iCracked.log.info('Attempting to login: ' + username);
	iCracked.API.post('login',
		{
			'username': username,
			'password': password,
			'cookies': true
		}, function(response) {
			if (response.status == 200) {
				successCallback(response.responseJSON);
			} else {
				errorCallback(response.status);
			}
		}
	);
}

iCracked.API = {
	init: function(url) {
		this.defaultHeaders = {};
		this.url = url;
		this.setSessionToken = false;

		var verbs = ['POST', 'GET', 'DELETE', 'PUT', 'PATCH'];
		for (var verb in verbs) {
			(function(that, verb) {
				that[verb.toLowerCase()] = function(controller, params, callback, headers) {
					that.call(verb, controller, callback, params, headers);
				}
			})(this, verbs[verb]);
		}
	},
	call: function(verb, controller, callback, params, headers) {
		var that = this;
			target = this.url + '/' + controller;
			headers = $.extend({}, iCracked.API.defaultHeaders, headers || {}),
			toSend = '';

		iCracked.log.trace('Calling API ' + verb.toUpperCase() + ' :: ' + target);

		if (Object.keys(params).length) {
			if (verb === 'GET') {
				toSend = params;
			} else {
				toSend = JSON.stringify(params);
			}
		}


		if (iCracked.API.setSessionToken) {
			var value = "; " + document.cookie;
			headers['X-Session-Token'] = value.split("; PHPSESSID=").pop().split(";").shift();
		}

		$.ajax({
			url: target,
			dataType: 'json',
			type: verb,
			data: toSend,
			beforeSend: function (xhr) {
				for (var header in headers) {
					xhr.setRequestHeader(header, headers[header]);
				}
			},
			complete: function(response) {
				iCracked.log.trace('API Response => ' + response.status);

				switch (response.status) {
					// pickup 401 for authentication
					default:
						callback(response);
				}
			}
		})
	}
};

iCracked.uploader = function() {
	this.uploadOptions = {

	}
}

iCracked.uploader.prototype = {
	init: function(target, options) {
		for (var prop in options) {
			this.uploadOptions[prop] = options[prop];
		}

		if (!target.length) {
			alert('invalid form');
			return;
		}

		var preview = target.find('.uploadPreview');
		if (preview.length) {
			this.uploadOptions.preview = preview;
		}

		this.target = target;
		var file = target.find('input[type=file]');
		var self = this;

		file.on('change', function(e) {
			self.handleFile(this.files[0]);
		});
	},

	handleFile: function (file) {
		var reader = new FileReader(), self = this;
		var img = $('#imageCrop'), preview = $('#modalPreview');

		var updatePositions = function(coords) {
			$('#cropDone').removeClass('disabled');

			self.target.find('input[name="crop_x"]').val(coords.x);
			self.target.find('input[name="crop_y"]').val(coords.y);
			self.target.find('input[name="crop_w"]').val(coords.w);
			self.target.find('input[name="crop_h"]').val(coords.h);

			var nh = img[0].naturalHeight,
				nw = img[0].naturalWidth,
				rx = 100 / coords.w,
				ry = 100 / coords.h;

			preview.css({
				width: Math.round(rx * nw) + 'px',
				height: Math.round(ry * nh) + 'px',
				marginLeft: '-' + Math.round(rx * coords.x) + 'px',
				marginTop: '-' + Math.round(ry * coords.y) + 'px'
			});
		};

		reader.onload = function(e) {
			img.attr('src', e.target.result);
			preview.attr('src', e.target.result);

			$('#cropModal').foundation('reveal', 'open').on('close', function() {
				$(this).off('close');
				$('#cropDone').off('click');
				$('#cropCancel').off('click');

				img.replaceWith('<img id="imageCrop" />');
				$('.jcrop-holder').remove();
			});

			$('#cropDone').on('click', function(e) {
				if ($(this).hasClass('disabled'))
					return false;

				$('#cropModal').foundation('reveal', 'close');
				$('form[name="imageUpload"]').submit();
				e.preventDefault();
			});

			$('#cropCancel').on('click', function(e) {
				$('#cropModal').foundation('reveal', 'close');
				e.preventDefault();
			});

			img.load(function() {
				var w = this.width,
						h = this.height,
						x = w/2,
						y = h/2;

				img.Jcrop({
					onChange: updatePositions,
								setSelect:   [250, 250, 0, 0],
								minSize: [250, 250],
								aspectRatio: 1
						});
			});
		};

		reader.readAsDataURL(file);
	},
}

iCracked.mapper = function() {
	this.mapOptions = {
		zoomControl: false
	},

	this.container = null,
	this.markers = [],
	this.infoWindows = [];
};

iCracked.mapper.prototype = {
	init: function(target, options) {
		this.container = target;

		for (var prop in options) {
			this.mapOptions[prop] = options[prop];
		}

		this.map = L.mapbox.map(target, 'icracked.map-0t4ttb1b', this.mapOptions);
		this.map.setView(this.mapOptions.center, this.mapOptions.zoom);
	},

	getMap: function() {
		return this.map;
	},

	latLng: function(lat, lng) {
		return new google.maps.LatLng(lat, lng);
	},

	addMarker: function(lat, lng, title, description, size, color, symbol) {
		L.mapbox.markerLayer({
				type: 'Feature',
				geometry: {
						type: 'Point',
						coordinates: [lng, lat]
				},
				properties: {
						'title': title,
						'description': description,
						'marker-size': size !== undefined ? size : 'medium',
						'marker-color': color !== undefined ? color : '#73B6E6',
						'marker-symbol': symbol !== undefined ? symbol : ''
				}
		}).addTo(this.map);
	},

	setStatic: function() {
		this.map.dragging.disable();
		this.map.touchZoom.disable();
		this.map.doubleClickZoom.disable();
		this.map.scrollWheelZoom.disable();

		if (this.map.tap) {
			this.map.tap.disable();
		}
	}
};

// =================================================================================================
// Dashboard Modal
// + Open/Close dashboard modal for errors, warnings or important messages
// =================================================================================================
iCracked.dashboardModal = {
	selector			: $('#dashboardModal'),
	blackoutSelector	: $('#dashboardModalBlackout'),
	heading				: $('.heading', this.selector),
	description			: $('.description', this.selector),

	open: function(myHeading, myDescription, styleClass) {
		var self = this;

		if (typeof styleClass == 'undefined') { styleClass = 'default'; }
		self.selector.removeClass('default success warning error').addClass(styleClass);
		self.heading.html(myHeading + '<div class="pocketFill"></div>');
		self.description.html(myDescription);
		self.selector.addClass('open');

		$('.close', self.selector).on('click', function() {
			self.close();
		});
		self.blackoutSelector.on('click', function() {
			self.close();
		});
	},
	close: function() {
		this.selector.removeClass('open');
	},
	isOpen: function() {
		if (this.selector.is(':visible')) { return true; }
		else { return false; }
	}
};

// =================================================================================================
// quickEach
// + Because .each() is too damn slow
// =================================================================================================
$.fn.quickEach = $.fn.quickEach || (function () {
	var jq = jQuery([1]);
	return function (c) {
		var i = -1,
		el,
		len = this.length;
		try {
			while (++i < len && (el = jq[0] = this[i]) && c.call(jq, i, el) !== false);
		} catch (e) {
			delete jq[0];
			throw e;
		}
		delete jq[0];
		return this;
	};
}());

// =================================================================================================
// Visible / Hidden
// + Give css visible property show(), hide(), is(':visible') like functionality
// =================================================================================================
$.fn.visible = function() {
		return this.css('visibility', 'visible');
}

$.fn.hidden = function() {
		return this.css('visibility', 'hidden');
}

$.fn.visibilityToggle = function() {
		return this.css('visibility', function(i, visibility) {
				return (visibility == 'visible') ? 'hidden' : 'visible';
		});
}

$.fn.isVisible = function(state) {
		state = state.replace(':', '');
		if(state != 'visible' && state != 'hidden') {
				console.error('Invalid isVisible state: ' + state);
		}
		else {
				if ($(this).css('visibility') == state) { return true; }
				else { return false; }
		}
}

// =================================================================================================
// Constrain Input
// + Prevent certain characters or keys from being used in an text input element
// - Inputs: (regexpKeys, disallowedKeys, maxLength)
//     [disallowedKeys] accepted arguments:
//        backspace delete tab esc enter end home insert pageup pagedown    pause numlock scrolllock
//        capslock left rightup down ctrl cmd alt shift copy cut paste drop
// =================================================================================================
var keyDownMappings     = { 8:'backspace',      46:'delete',    9:'tab',        27:'esc',
														13:'enter',         35:'end',       36:'home',      45:'insert',
														33:'pageup',        34:'pagedown',  19:'pause',     144:'numlock',
														145:'scrolllock',   20:'capslock',  37:'left',      39:'right',
														38:'up',            40:'down' };
var keyPressMappings    = { 8:'backspace',      13:'enter',     0: 'none' };

$.fn.constrainInput = function(regexpKeys, blockedKeys, maxLength) {
		// Optional argument defaults
		if(typeof(blockedKeys) === 'undefined') { blockedKeys = false; }
		if(typeof(maxLength) === 'undefined') { maxLength = false; }

		blockedKeys = blockedKeys.split(' ');

		var self = this;

		self.each(function() {
				// Prevent autocomplete
				if(blockedKeys.indexOf('autocomplete') > -1) {
						$(self).attr('autocomplete', 'off');
				}
				// Prevent Copy
				$(self).on('copy', function(event) {
						if (blockedKeys.indexOf('copy') != -1)     { event.preventDefault(); }
				});
				// Prevent Cut
				$(self).on('cut', function(event) {
						if (blockedKeys.indexOf('cut') != -1)     { event.preventDefault(); }
				});
				// Prevent Paste
				$(self).on('paste', function(event) {
						if (blockedKeys.indexOf('paste') != -1) { event.preventDefault(); }
				});
				// Prevent Drop
				$(self).on('drop', function(event) {
						if (blockedKeys.indexOf('drop') != -1)     { event.preventDefault(); }
				});
				// Prevent Keypress (characters)
				$(self).on('keypress', function(event) {
						var key = event.which;
						var character = String.fromCharCode(key);

						// ignore keys in keyPressMappings (handled in keydown) & when modifier keys are being pressed
						if(!(key in keyPressMappings) && event.metaKey != true && event.ctrlKey != true && event.altKey != true){
								// Limit maxLength
								if(maxLength !== false) {
										if( $(self).val().length >= maxLength )    { event.preventDefault(); }
								}
								// Prevent characters not specified in regexpKeys
								if(!regexpKeys.test(character)) {
										event.preventDefault();
								}
						}
				});
				// Prevent Keydown (keys/modifiers)
				$(self).on('keydown', function(event) {
						var key = event.which;
						// --------------------------------------------------
						// KEYS/MODIFIERS
						// --------------------------------------------------
						// F1-F12                   112 -> 123
						// Backspace                8
						// Delete                   46
						// Tab                      9
						// Enter                    13
						// Esc                      27
						// Page Up                  33
						// Page Down                34
						// End                      35
						// Home                     36
						// Insert                   45
						// Left                     37
						// Up                       38
						// Right                    39
						// Down                     40
						// Pause/Break              19
						// Caps Lock                20
						// Num lock                 144
						// Scroll lock              145
						// Ctrl                     17, event.ctrlKey
						// Cmd    (left)            91, event.metaKey
						// Cmd    (right)           93, event.metaKey
						// Alt/Opt                  18, event.altKey
						// Shift                    16, event.shiftKey
						// --------------------------------------------------
						// CHARACTERS
						// --------------------------------------------------
						// Space                    32
						// a-z                      65 -> 90
						// A-Z                      65 -> 90 + event.shiftKey
						// 0-9                      48 -> 57
						// 0-9          [numpad]    96 -> 105
						// * + - . /    [numpad]    106 -> 111
						// ) ! @ # $ % ^ & * (      48 -> 57 + event.shiftKey
						// ` ~                      192, 192 + event.shiftKey
						// - _                      189, 189 + event.shiftKey
						// = +                      187, 187 + event.shiftKey
						// [ {                      219, 219 + event.shiftKey
						// ] }                      221, 221 + event.shiftKey
						// \ |                      220, 220 + event.shiftKey
						// ; :                      186, 186 + event.shiftKey
						// ' "                      222, 222 + event.shiftKey
						// , <                      188, 188 + event.shiftKey
						// . >                      190, 190 + event.shiftKey
						// / ?                      191, 191 + event.shiftKey
						// --------------------------------------------------

						// Prevent keys specified in disallowedKeys input
						if ((blockedKeys.indexOf(keyDownMappings[key]) != -1) ||
								(blockedKeys.indexOf('ctrl')  != -1 && event.ctrlKey) ||
								(blockedKeys.indexOf('cmd')   != -1 && event.metaKey) ||
								(blockedKeys.indexOf('alt')   != -1 && event.altKey)  ||
								(blockedKeys.indexOf('shift') != -1 && event.shiftKey))
						{
								event.preventDefault();
						}

				});

		});
		return self;
};

/**
 * jQuery Geocoding and Places Autocomplete Plugin - V 1.5.0
 *
 * @author Martin Kleppe <kleppe@ubilabs.net>, 2012
 * @author Ubilabs http://ubilabs.net, 2012
 * @license MIT License <http://www.opensource.org/licenses/mit-license.php>
 */
(function($,window,document,undefined){var defaults={bounds:true,country:null,map:false,details:false,detailsAttribute:"name",autoselect:true,location:false,mapOptions:{zoom:14,scrollwheel:false,mapTypeId:"roadmap"},markerOptions:{draggable:false},maxZoom:16,types:["geocode"],blur:false};var componentTypes=("street_address route intersection political "+"country administrative_area_level_1 administrative_area_level_2 "+"administrative_area_level_3 colloquial_area locality sublocality "+"neighborhood premise subpremise postal_code natural_feature airport "+"park point_of_interest post_box street_number floor room "+"lat lng viewport location "+"formatted_address location_type bounds").split(" ");var placesDetails=("id url website vicinity reference name rating "+"international_phone_number icon formatted_phone_number").split(" ");function GeoComplete(input,options){this.options=$.extend(true,{},defaults,options);this.input=input;this.$input=$(input);this._defaults=defaults;this._name="geocomplete";this.init()}$.extend(GeoComplete.prototype,{init:function(){this.initMap();this.initMarker();this.initGeocoder();this.initDetails();this.initLocation()},initMap:function(){if(!this.options.map){return}if(typeof this.options.map.setCenter=="function"){this.map=this.options.map;return}this.map=new google.maps.Map($(this.options.map)[0],this.options.mapOptions);google.maps.event.addListener(this.map,"click",$.proxy(this.mapClicked,this));google.maps.event.addListener(this.map,"zoom_changed",$.proxy(this.mapZoomed,this))},initMarker:function(){if(!this.map){return}var options=$.extend(this.options.markerOptions,{map:this.map});if(options.disabled){return}this.marker=new google.maps.Marker(options);google.maps.event.addListener(this.marker,"dragend",$.proxy(this.markerDragged,this))},initGeocoder:function(){var options={types:this.options.types,bounds:this.options.bounds===true?null:this.options.bounds,componentRestrictions:this.options.componentRestrictions};if(this.options.country){options.componentRestrictions={country:this.options.country}}this.autocomplete=new google.maps.places.Autocomplete(this.input,options);this.geocoder=new google.maps.Geocoder;if(this.map&&this.options.bounds===true){this.autocomplete.bindTo("bounds",this.map)}google.maps.event.addListener(this.autocomplete,"place_changed",$.proxy(this.placeChanged,this));this.$input.keypress(function(event){if(event.keyCode===13){return false}});this.$input.bind("geocode",$.proxy(function(){this.find()},this));if(this.options.blur===true){this.$input.blur($.proxy(function(){this.find()},this))}},initDetails:function(){if(!this.options.details){return}var $details=$(this.options.details),attribute=this.options.detailsAttribute,details={};function setDetail(value){details[value]=$details.find("["+attribute+"="+value+"]")}$.each(componentTypes,function(index,key){setDetail(key);setDetail(key+"_short")});$.each(placesDetails,function(index,key){setDetail(key)});this.$details=$details;this.details=details},initLocation:function(){var location=this.options.location,latLng;if(!location){return}if(typeof location=="string"){this.find(location);return}if(location instanceof Array){latLng=new google.maps.LatLng(location[0],location[1])}if(location instanceof google.maps.LatLng){latLng=location}if(latLng){if(this.map){this.map.setCenter(latLng)}if(this.marker){this.marker.setPosition(latLng)}}},find:function(address){this.geocode({address:address||this.$input.val()})},geocode:function(request){if(this.options.bounds&&!request.bounds){if(this.options.bounds===true){request.bounds=this.map&&this.map.getBounds()}else{request.bounds=this.options.bounds}}if(this.options.country){request.region=this.options.country}this.geocoder.geocode(request,$.proxy(this.handleGeocode,this))},selectFirstResult:function(){var selected="";if($(".pac-item-selected")["0"]){selected="-selected"}var $span1=$(".pac-container .pac-item"+selected+":first span:nth-child(2)").text();var $span2=$(".pac-container .pac-item"+selected+":first span:nth-child(3)").text();var firstResult=$span1;if($span2){firstResult+=" - "+$span2}this.$input.val(firstResult);return firstResult},handleGeocode:function(results,status){if(status===google.maps.GeocoderStatus.OK){var result=results[0];this.$input.val(result.formatted_address);this.update(result);if(results.length>1){this.trigger("geocode:multiple",results)}}else{this.trigger("geocode:error",status)}},trigger:function(event,argument){this.$input.trigger(event,[argument])},center:function(geometry){if(geometry.viewport){this.map.fitBounds(geometry.viewport);if(this.map.getZoom()>this.options.maxZoom){this.map.setZoom(this.options.maxZoom)}}else{this.map.setZoom(this.options.maxZoom);this.map.setCenter(geometry.location)}if(this.marker){this.marker.setPosition(geometry.location);this.marker.setAnimation(this.options.markerOptions.animation)}},update:function(result){if(this.map){this.center(result.geometry)}if(this.$details){this.fillDetails(result)}this.trigger("geocode:result",result)},fillDetails:function(result){var data={},geometry=result.geometry,viewport=geometry.viewport,bounds=geometry.bounds;$.each(result.address_components,function(index,object){var name=object.types[0];data[name]=object.long_name;data[name+"_short"]=object.short_name});$.each(placesDetails,function(index,key){data[key]=result[key]});$.extend(data,{formatted_address:result.formatted_address,location_type:geometry.location_type||"PLACES",viewport:viewport,bounds:bounds,location:geometry.location,lat:geometry.location.lat(),lng:geometry.location.lng()});$.each(this.details,$.proxy(function(key,$detail){var value=data[key];this.setDetail($detail,value)},this));this.data=data},setDetail:function($element,value){if(value===undefined){value=""}else if(typeof value.toUrlValue=="function"){value=value.toUrlValue()}if($element.is(":input")){$element.val(value)}else{$element.text(value)}},markerDragged:function(event){this.trigger("geocode:dragged",event.latLng)},mapClicked:function(event){this.trigger("geocode:click",event.latLng)},mapZoomed:function(event){this.trigger("geocode:zoom",this.map.getZoom())},resetMarker:function(){this.marker.setPosition(this.data.location);this.setDetail(this.details.lat,this.data.location.lat());this.setDetail(this.details.lng,this.data.location.lng())},placeChanged:function(){var place=this.autocomplete.getPlace();if(!place.geometry){if(this.options.autoselect){var autoSelection=this.selectFirstResult();this.find(autoSelection)}}else{this.update(place)}}});$.fn.geocomplete=function(options){var attribute="plugin_geocomplete";if(typeof options=="string"){var instance=$(this).data(attribute)||$(this).geocomplete().data(attribute),prop=instance[options];if(typeof prop=="function"){prop.apply(instance,Array.prototype.slice.call(arguments,1));return $(this)}else{if(arguments.length==2){prop=arguments[1]}return prop}}else{return this.each(function(){var instance=$.data(this,attribute);if(!instance){instance=new GeoComplete(this,options);$.data(this,attribute,instance)}})}}})(jQuery,window,document);

// this allows location autocomplete to be added via mobile (fastclick.js was messing with it)

$(document).on({
		'DOMNodeInserted': function() {
				$('.pac-item, .pac-item span', this).addClass('needsclick');
		}
}, '.pac-container');

// Close the referral modal on the dispatch pages
$(".dispatch-referral__button").on("click", function(e) {
	e.preventDefault();
	$(this).parents(".dispatch-referral__module").fadeOut();
});

$(".container-dispatch__button").on("click", function(e) {
	e.preventDefault();
	$(this).parents(".container-dispatch__information").hide();
	$(".option-container__dispatch__form").fadeIn();
});

//Country Codes on Dispatch Page
$( '.phone-country' ).on( 'click', function(e) {
	var offset = $(this).offset();
	$('.phone-country__menu').toggleClass('display-menu').css({'top': offset.top += 35, 'left': offset.left });
});

$('.country-menu__container').on('click', function(e) {
	$('.phone-country__menu').addClass('display-menu');
});

// JSON to CSV Converter

function ConvertToCSV(headers, objArray) {
	var array = typeof objArray !== 'object' ? JSON.parse(objArray) : objArray;
	var str = headers +'';

	for (var i = 0; i < array.length; i++) {
		var line = '';
		for (var index in array[i]) {
			if (line != '') { line += ','; }
			if (!!array[i][index] && array[i][index].indexOf(',') !== -1) {array[i][index] = '\"'+array[i][index]+'\"'}
			line += array[i][index];
		}

		str += line + '\r\n';
	}
	return str;
}

$('.simply-scroll-list').simplyScroll();

$('.repair-questions__body').on('click', 'section > a', function (e) {
	$(this).toggleClass('active').next('.requirement-info').toggleClass('is-open');
});

$(document).ready(function() {
	//MOBILE FOOTER DROPWDOWN
	$('.footerMain__textBox--moreOption h3 a.footerText__titleLink').on('click', function () {
		$('.footerMain__textBox--moreOption ul.footerMain__moreOptions').slideToggle();
	});

	//MOBILE CONTACT PAGE DROPDOWN
	$('.supportQuestions__item li.supportQuestions__title').on('click', function () {
		if ($(window).width() < 600) {
			$(this).children().slideToggle();
		}
	});

	$(window).on('resize', function() {
		if ($(window).width() > 600) {
			$('ul.supportQuestions__item--list').show()
		}
	});

	$('.contactItem__dropdownTrigger').on('click', function () {
		$('.contactItem .contactItem__list').slideToggle();
	});

	//iTech Application JS
	if ($('.itech-prescreen__questions input').length) {
		$('.itech-prescreen__questions input').iCheck({
			checkboxClass: 'icheckbox_square-blue',
			radioClass: 'iradio_square-blue',
			//increaseArea: '20%' // optional
		});
	}

	if ($('.icheck input').length) {
		// todo:task merge to angular directive
		$('.icheck input').iCheck({
			checkboxClass: 'icheckbox_square-blue',
			radioClass: 'iradio_square-blue',
			//increaseArea: '20%' // optional
		});
	}
});

// Homepage Tweaks
$(document).ready(function() {
	 $('.center-slick').slick({
		 centerMode: true,
		 centerPadding: '60px',
		 slidesToShow: 7,
		 responsive: [
			 {
				 breakpoint: 768,
				 settings: {
					 arrows: true,
					 centerMode: true,
					 centerPadding: '40px',
					 slidesToShow: 3
				 }
			 },
			 {
				 breakpoint: 480,
				 settings: {
					 arrows: true,
					 centerMode: true,
					 centerPadding: '40px',
					 slidesToShow: 1
				 }
			 }
		 ]
	});

	$('.careersSlider').slick({
		 slidesToShow: 3,
		 slidesToScroll: 1,
		 centerPadding: '60px',
		 infinite: true,
		 responsive: [
			 {
				 breakpoint: 768,
				 settings: {
					 arrows: true,
					 slidesToShow: 3
				 }
			 },
			 {
				 breakpoint: 480,
				 settings: {
					 arrows: true,
					 slidesToShow: 1
				 }
			 }
		 ]
	});

	function loop() {
		$(".testimonial").each(function() {
			var current = $(this).children(".current").removeClass("current");
			var i = current.next().length ? current.index() : 0;
			current.siblings(":eq(" + i + ")").addClass("current");
		});
	}

	function loop2() {
		$(".testimonial2").each(function() {
			var currentSecond = $(this).children(".current").removeClass("current");
			var i = currentSecond.next().length ? currentSecond.index() : 0;
			currentSecond.siblings(":eq(" + i + ")").addClass("current");
		});
	}

	setInterval(loop, 4000);
	setInterval(loop2, 7000);

	$('.navigation__site-link--more, .navigation--menu-icon').on('click', function () {
		$("#main-nav-drop").toggleClass('nav-open');
		$("body").addClass("modal-open");
	});

	$('.nav__dropdown--close').on('click', function () {
		$('#main-nav-drop').removeClass('nav-open');
		$('body').removeClass('modal-open');
	});

	$('.cta__locationInput input, .cta__locationInput--sell input').typing({
		start: function (event, $elem) {
			//$elem.css('background', '#fa0');
		},
		stop: function (event, $elem) {
			//$elem.parent().siblings('.cta__button').addClass('visible');
		},
		delay: 1000
	});
});

//Google Analytics Event Tracker
$('.repairDispatchGA').on('click', function() {
	ga('send', 'event', 'button', 'click', 'repair_dispatch');
});

// jQuery Validate
/* Copyright (c) 2013 JÃ¶rn Zaefferer; Licensed MIT */
(function(t){t.extend(t.fn,{validate:function(e){if(!this.length)return e&&e.debug&&window.console&&console.warn("Nothing selected, can't validate, returning nothing."),void 0;var i=t.data(this[0],"validator");return i?i:(this.attr("novalidate","novalidate"),i=new t.validator(e,this[0]),t.data(this[0],"validator",i),i.settings.onsubmit&&(this.validateDelegate(":submit","click",function(e){i.settings.submitHandler&&(i.submitButton=e.target),t(e.target).hasClass("cancel")&&(i.cancelSubmit=!0),void 0!==t(e.target).attr("formnovalidate")&&(i.cancelSubmit=!0)}),this.submit(function(e){function s(){var s;return i.settings.submitHandler?(i.submitButton&&(s=t("<input type='hidden'/>").attr("name",i.submitButton.name).val(t(i.submitButton).val()).appendTo(i.currentForm)),i.settings.submitHandler.call(i,i.currentForm,e),i.submitButton&&s.remove(),!1):!0}return i.settings.debug&&e.preventDefault(),i.cancelSubmit?(i.cancelSubmit=!1,s()):i.form()?i.pendingRequest?(i.formSubmitted=!0,!1):s():(i.focusInvalid(),!1)})),i)},valid:function(){if(t(this[0]).is("form"))return this.validate().form();var e=!0,i=t(this[0].form).validate();return this.each(function(){e=e&&i.element(this)}),e},removeAttrs:function(e){var i={},s=this;return t.each(e.split(/\s/),function(t,e){i[e]=s.attr(e),s.removeAttr(e)}),i},rules:function(e,i){var s=this[0];if(e){var r=t.data(s.form,"validator").settings,n=r.rules,a=t.validator.staticRules(s);switch(e){case"add":t.extend(a,t.validator.normalizeRule(i)),delete a.messages,n[s.name]=a,i.messages&&(r.messages[s.name]=t.extend(r.messages[s.name],i.messages));break;case"remove":if(!i)return delete n[s.name],a;var u={};return t.each(i.split(/\s/),function(t,e){u[e]=a[e],delete a[e]}),u}}var o=t.validator.normalizeRules(t.extend({},t.validator.classRules(s),t.validator.attributeRules(s),t.validator.dataRules(s),t.validator.staticRules(s)),s);if(o.required){var l=o.required;delete o.required,o=t.extend({required:l},o)}return o}}),t.extend(t.expr[":"],{blank:function(e){return!t.trim(""+t(e).val())},filled:function(e){return!!t.trim(""+t(e).val())},unchecked:function(e){return!t(e).prop("checked")}}),t.validator=function(e,i){this.settings=t.extend(!0,{},t.validator.defaults,e),this.currentForm=i,this.init()},t.validator.format=function(e,i){return 1===arguments.length?function(){var i=t.makeArray(arguments);return i.unshift(e),t.validator.format.apply(this,i)}:(arguments.length>2&&i.constructor!==Array&&(i=t.makeArray(arguments).slice(1)),i.constructor!==Array&&(i=[i]),t.each(i,function(t,i){e=e.replace(RegExp("\\{"+t+"\\}","g"),function(){return i})}),e)},t.extend(t.validator,{defaults:{messages:{},groups:{},rules:{},errorClass:"error",validClass:"valid",errorElement:"label",focusInvalid:!0,errorContainer:t([]),errorLabelContainer:t([]),onsubmit:!0,ignore:":hidden",ignoreTitle:!1,onfocusin:function(t){this.lastActive=t,this.settings.focusCleanup&&!this.blockFocusCleanup&&(this.settings.unhighlight&&this.settings.unhighlight.call(this,t,this.settings.errorClass,this.settings.validClass),this.addWrapper(this.errorsFor(t)).hide())},onfocusout:function(t){this.checkable(t)||!(t.name in this.submitted)&&this.optional(t)||this.element(t)},onkeyup:function(t,e){(9!==e.which||""!==this.elementValue(t))&&(t.name in this.submitted||t===this.lastElement)&&this.element(t)},onclick:function(t){t.name in this.submitted?this.element(t):t.parentNode.name in this.submitted&&this.element(t.parentNode)},highlight:function(e,i,s){"radio"===e.type?this.findByName(e.name).addClass(i).removeClass(s):t(e).addClass(i).removeClass(s)},unhighlight:function(e,i,s){"radio"===e.type?this.findByName(e.name).removeClass(i).addClass(s):t(e).removeClass(i).addClass(s)}},setDefaults:function(e){t.extend(t.validator.defaults,e)},messages:{required:"This field is required.",remote:"Please fix this field.",email:"Please enter a valid email address.",url:"Please enter a valid URL.",date:"Please enter a valid date.",dateISO:"Please enter a valid date (ISO).",number:"Please enter a valid number.",digits:"Please enter only digits.",creditcard:"Please enter a valid credit card number.",equalTo:"Please enter the same value again.",maxlength:t.validator.format("Please enter no more than {0} characters."),minlength:t.validator.format("Please enter at least {0} characters."),rangelength:t.validator.format("Please enter a value between {0} and {1} characters long."),range:t.validator.format("Please enter a value between {0} and {1}."),max:t.validator.format("Please enter a value less than or equal to {0}."),min:t.validator.format("Please enter a value greater than or equal to {0}.")},autoCreateRanges:!1,prototype:{init:function(){function e(e){var i=t.data(this[0].form,"validator"),s="on"+e.type.replace(/^validate/,"");i.settings[s]&&i.settings[s].call(i,this[0],e)}this.labelContainer=t(this.settings.errorLabelContainer),this.errorContext=this.labelContainer.length&&this.labelContainer||t(this.currentForm),this.containers=t(this.settings.errorContainer).add(this.settings.errorLabelContainer),this.submitted={},this.valueCache={},this.pendingRequest=0,this.pending={},this.invalid={},this.reset();var i=this.groups={};t.each(this.settings.groups,function(e,s){"string"==typeof s&&(s=s.split(/\s/)),t.each(s,function(t,s){i[s]=e})});var s=this.settings.rules;t.each(s,function(e,i){s[e]=t.validator.normalizeRule(i)}),t(this.currentForm).validateDelegate(":text, [type='password'], [type='file'], select, textarea, [type='number'], [type='search'] ,[type='tel'], [type='url'], [type='email'], [type='datetime'], [type='date'], [type='month'], [type='week'], [type='time'], [type='datetime-local'], [type='range'], [type='color'] ","focusin focusout keyup",e).validateDelegate("[type='radio'], [type='checkbox'], select, option","click",e),this.settings.invalidHandler&&t(this.currentForm).bind("invalid-form.validate",this.settings.invalidHandler)},form:function(){return this.checkForm(),t.extend(this.submitted,this.errorMap),this.invalid=t.extend({},this.errorMap),this.valid()||t(this.currentForm).triggerHandler("invalid-form",[this]),this.showErrors(),this.valid()},checkForm:function(){this.prepareForm();for(var t=0,e=this.currentElements=this.elements();e[t];t++)this.check(e[t]);return this.valid()},element:function(e){e=this.validationTargetFor(this.clean(e)),this.lastElement=e,this.prepareElement(e),this.currentElements=t(e);var i=this.check(e)!==!1;return i?delete this.invalid[e.name]:this.invalid[e.name]=!0,this.numberOfInvalids()||(this.toHide=this.toHide.add(this.containers)),this.showErrors(),i},showErrors:function(e){if(e){t.extend(this.errorMap,e),this.errorList=[];for(var i in e)this.errorList.push({message:e[i],element:this.findByName(i)[0]});this.successList=t.grep(this.successList,function(t){return!(t.name in e)})}this.settings.showErrors?this.settings.showErrors.call(this,this.errorMap,this.errorList):this.defaultShowErrors()},resetForm:function(){t.fn.resetForm&&t(this.currentForm).resetForm(),this.submitted={},this.lastElement=null,this.prepareForm(),this.hideErrors(),this.elements().removeClass(this.settings.errorClass).removeData("previousValue")},numberOfInvalids:function(){return this.objectLength(this.invalid)},objectLength:function(t){var e=0;for(var i in t)e++;return e},hideErrors:function(){this.addWrapper(this.toHide).hide()},valid:function(){return 0===this.size()},size:function(){return this.errorList.length},focusInvalid:function(){if(this.settings.focusInvalid)try{t(this.findLastActive()||this.errorList.length&&this.errorList[0].element||[]).filter(":visible").focus().trigger("focusin")}catch(e){}},findLastActive:function(){var e=this.lastActive;return e&&1===t.grep(this.errorList,function(t){return t.element.name===e.name}).length&&e},elements:function(){var e=this,i={};return t(this.currentForm).find("input, select, textarea").not(":submit, :reset, :image, [disabled]").not(this.settings.ignore).filter(function(){return!this.name&&e.settings.debug&&window.console&&console.error("%o has no name assigned",this),this.name in i||!e.objectLength(t(this).rules())?!1:(i[this.name]=!0,!0)})},clean:function(e){return t(e)[0]},errors:function(){var e=this.settings.errorClass.replace(" ",".");return t(this.settings.errorElement+"."+e,this.errorContext)},reset:function(){this.successList=[],this.errorList=[],this.errorMap={},this.toShow=t([]),this.toHide=t([]),this.currentElements=t([])},prepareForm:function(){this.reset(),this.toHide=this.errors().add(this.containers)},prepareElement:function(t){this.reset(),this.toHide=this.errorsFor(t)},elementValue:function(e){var i=t(e).attr("type"),s=t(e).val();return"radio"===i||"checkbox"===i?t("input[name='"+t(e).attr("name")+"']:checked").val():"string"==typeof s?s.replace(/\r/g,""):s},check:function(e){e=this.validationTargetFor(this.clean(e));var i,s=t(e).rules(),r=!1,n=this.elementValue(e);for(var a in s){var u={method:a,parameters:s[a]};try{if(i=t.validator.methods[a].call(this,n,e,u.parameters),"dependency-mismatch"===i){r=!0;continue}if(r=!1,"pending"===i)return this.toHide=this.toHide.not(this.errorsFor(e)),void 0;if(!i)return this.formatAndAdd(e,u),!1}catch(o){throw this.settings.debug&&window.console&&console.log("Exception occurred when checking element "+e.id+", check the '"+u.method+"' method.",o),o}}return r?void 0:(this.objectLength(s)&&this.successList.push(e),!0)},customDataMessage:function(e,i){return t(e).data("msg-"+i.toLowerCase())||e.attributes&&t(e).attr("data-msg-"+i.toLowerCase())},customMessage:function(t,e){var i=this.settings.messages[t];return i&&(i.constructor===String?i:i[e])},findDefined:function(){for(var t=0;arguments.length>t;t++)if(void 0!==arguments[t])return arguments[t];return void 0},defaultMessage:function(e,i){return this.findDefined(this.customMessage(e.name,i),this.customDataMessage(e,i),!this.settings.ignoreTitle&&e.title||void 0,t.validator.messages[i],"<strong>Warning: No message defined for "+e.name+"</strong>")},formatAndAdd:function(e,i){var s=this.defaultMessage(e,i.method),r=/\$?\{(\d+)\}/g;"function"==typeof s?s=s.call(this,i.parameters,e):r.test(s)&&(s=t.validator.format(s.replace(r,"{$1}"),i.parameters)),this.errorList.push({message:s,element:e}),this.errorMap[e.name]=s,this.submitted[e.name]=s},addWrapper:function(t){return this.settings.wrapper&&(t=t.add(t.parent(this.settings.wrapper))),t},defaultShowErrors:function(){var t,e;for(t=0;this.errorList[t];t++){var i=this.errorList[t];this.settings.highlight&&this.settings.highlight.call(this,i.element,this.settings.errorClass,this.settings.validClass),this.showLabel(i.element,i.message)}if(this.errorList.length&&(this.toShow=this.toShow.add(this.containers)),this.settings.success)for(t=0;this.successList[t];t++)this.showLabel(this.successList[t]);if(this.settings.unhighlight)for(t=0,e=this.validElements();e[t];t++)this.settings.unhighlight.call(this,e[t],this.settings.errorClass,this.settings.validClass);this.toHide=this.toHide.not(this.toShow),this.hideErrors(),this.addWrapper(this.toShow).show()},validElements:function(){return this.currentElements.not(this.invalidElements())},invalidElements:function(){return t(this.errorList).map(function(){return this.element})},showLabel:function(e,i){var s=this.errorsFor(e);s.length?(s.removeClass(this.settings.validClass).addClass(this.settings.errorClass),s.html(i)):(s=t("<"+this.settings.errorElement+">").attr("for",this.idOrName(e)).addClass(this.settings.errorClass).html(i||""),this.settings.wrapper&&(s=s.hide().show().wrap("<"+this.settings.wrapper+"/>").parent()),this.labelContainer.append(s).length||(this.settings.errorPlacement?this.settings.errorPlacement(s,t(e)):s.insertAfter(e))),!i&&this.settings.success&&(s.text(""),"string"==typeof this.settings.success?s.addClass(this.settings.success):this.settings.success(s,e)),this.toShow=this.toShow.add(s)},errorsFor:function(e){var i=this.idOrName(e);return this.errors().filter(function(){return t(this).attr("for")===i})},idOrName:function(t){return this.groups[t.name]||(this.checkable(t)?t.name:t.id||t.name)},validationTargetFor:function(t){return this.checkable(t)&&(t=this.findByName(t.name).not(this.settings.ignore)[0]),t},checkable:function(t){return/radio|checkbox/i.test(t.type)},findByName:function(e){return t(this.currentForm).find("[name='"+e+"']")},getLength:function(e,i){switch(i.nodeName.toLowerCase()){case"select":return t("option:selected",i).length;case"input":if(this.checkable(i))return this.findByName(i.name).filter(":checked").length}return e.length},depend:function(t,e){return this.dependTypes[typeof t]?this.dependTypes[typeof t](t,e):!0},dependTypes:{"boolean":function(t){return t},string:function(e,i){return!!t(e,i.form).length},"function":function(t,e){return t(e)}},optional:function(e){var i=this.elementValue(e);return!t.validator.methods.required.call(this,i,e)&&"dependency-mismatch"},startRequest:function(t){this.pending[t.name]||(this.pendingRequest++,this.pending[t.name]=!0)},stopRequest:function(e,i){this.pendingRequest--,0>this.pendingRequest&&(this.pendingRequest=0),delete this.pending[e.name],i&&0===this.pendingRequest&&this.formSubmitted&&this.form()?(t(this.currentForm).submit(),this.formSubmitted=!1):!i&&0===this.pendingRequest&&this.formSubmitted&&(t(this.currentForm).triggerHandler("invalid-form",[this]),this.formSubmitted=!1)},previousValue:function(e){return t.data(e,"previousValue")||t.data(e,"previousValue",{old:null,valid:!0,message:this.defaultMessage(e,"remote")})}},classRuleSettings:{required:{required:!0},email:{email:!0},url:{url:!0},date:{date:!0},dateISO:{dateISO:!0},number:{number:!0},digits:{digits:!0},creditcard:{creditcard:!0}},addClassRules:function(e,i){e.constructor===String?this.classRuleSettings[e]=i:t.extend(this.classRuleSettings,e)},classRules:function(e){var i={},s=t(e).attr("class");return s&&t.each(s.split(" "),function(){this in t.validator.classRuleSettings&&t.extend(i,t.validator.classRuleSettings[this])}),i},attributeRules:function(e){var i={},s=t(e),r=s[0].getAttribute("type");for(var n in t.validator.methods){var a;"required"===n?(a=s.get(0).getAttribute(n),""===a&&(a=!0),a=!!a):a=s.attr(n),/min|max/.test(n)&&(null===r||/number|range|text/.test(r))&&(a=Number(a)),a?i[n]=a:r===n&&"range"!==r&&(i[n]=!0)}return i.maxlength&&/-1|2147483647|524288/.test(i.maxlength)&&delete i.maxlength,i},dataRules:function(e){var i,s,r={},n=t(e);for(i in t.validator.methods)s=n.data("rule-"+i.toLowerCase()),void 0!==s&&(r[i]=s);return r},staticRules:function(e){var i={},s=t.data(e.form,"validator");return s.settings.rules&&(i=t.validator.normalizeRule(s.settings.rules[e.name])||{}),i},normalizeRules:function(e,i){return t.each(e,function(s,r){if(r===!1)return delete e[s],void 0;if(r.param||r.depends){var n=!0;switch(typeof r.depends){case"string":n=!!t(r.depends,i.form).length;break;case"function":n=r.depends.call(i,i)}n?e[s]=void 0!==r.param?r.param:!0:delete e[s]}}),t.each(e,function(s,r){e[s]=t.isFunction(r)?r(i):r}),t.each(["minlength","maxlength"],function(){e[this]&&(e[this]=Number(e[this]))}),t.each(["rangelength","range"],function(){var i;e[this]&&(t.isArray(e[this])?e[this]=[Number(e[this][0]),Number(e[this][1])]:"string"==typeof e[this]&&(i=e[this].split(/[\s,]+/),e[this]=[Number(i[0]),Number(i[1])]))}),t.validator.autoCreateRanges&&(e.min&&e.max&&(e.range=[e.min,e.max],delete e.min,delete e.max),e.minlength&&e.maxlength&&(e.rangelength=[e.minlength,e.maxlength],delete e.minlength,delete e.maxlength)),e},normalizeRule:function(e){if("string"==typeof e){var i={};t.each(e.split(/\s/),function(){i[this]=!0}),e=i}return e},addMethod:function(e,i,s){t.validator.methods[e]=i,t.validator.messages[e]=void 0!==s?s:t.validator.messages[e],3>i.length&&t.validator.addClassRules(e,t.validator.normalizeRule(e))},methods:{required:function(e,i,s){if(!this.depend(s,i))return"dependency-mismatch";if("select"===i.nodeName.toLowerCase()){var r=t(i).val();return r&&r.length>0}return this.checkable(i)?this.getLength(e,i)>0:t.trim(e).length>0},email:function(t,e){return this.optional(e)||/^((([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+(\.([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+)*)|((\x22)((((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(([\x01-\x08\x0b\x0c\x0e-\x1f\x7f]|\x21|[\x23-\x5b]|[\x5d-\x7e]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(\\([\x01-\x09\x0b\x0c\x0d-\x7f]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]))))*(((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(\x22)))@((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))$/i.test(t)},url:function(t,e){return this.optional(e)||/^(https?|s?ftp):\/\/(((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:)*@)?(((\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5]))|((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.?)(:\d*)?)(\/((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)+(\/(([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)*)*)?)?(\?((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|[\uE000-\uF8FF]|\/|\?)*)?(#((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|\/|\?)*)?$/i.test(t)},date:function(t,e){return this.optional(e)||!/Invalid|NaN/.test(""+new Date(t))},dateISO:function(t,e){return this.optional(e)||/^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/.test(t)},number:function(t,e){return this.optional(e)||/^-?(?:\d+|\d{1,3}(?:,\d{3})+)?(?:\.\d+)?$/.test(t)},digits:function(t,e){return this.optional(e)||/^\d+$/.test(t)},creditcard:function(t,e){if(this.optional(e))return"dependency-mismatch";if(/[^0-9 \-]+/.test(t))return!1;var i=0,s=0,r=!1;t=t.replace(/\D/g,"");for(var n=t.length-1;n>=0;n--){var a=t.charAt(n);s=parseInt(a,10),r&&(s*=2)>9&&(s-=9),i+=s,r=!r}return 0===i%10},minlength:function(e,i,s){var r=t.isArray(e)?e.length:this.getLength(t.trim(e),i);return this.optional(i)||r>=s},maxlength:function(e,i,s){var r=t.isArray(e)?e.length:this.getLength(t.trim(e),i);return this.optional(i)||s>=r},rangelength:function(e,i,s){var r=t.isArray(e)?e.length:this.getLength(t.trim(e),i);return this.optional(i)||r>=s[0]&&s[1]>=r},min:function(t,e,i){return this.optional(e)||t>=i},max:function(t,e,i){return this.optional(e)||i>=t},range:function(t,e,i){return this.optional(e)||t>=i[0]&&i[1]>=t},equalTo:function(e,i,s){var r=t(s);return this.settings.onfocusout&&r.unbind(".validate-equalTo").bind("blur.validate-equalTo",function(){t(i).valid()}),e===r.val()},remote:function(e,i,s){if(this.optional(i))return"dependency-mismatch";var r=this.previousValue(i);if(this.settings.messages[i.name]||(this.settings.messages[i.name]={}),r.originalMessage=this.settings.messages[i.name].remote,this.settings.messages[i.name].remote=r.message,s="string"==typeof s&&{url:s}||s,r.old===e)return r.valid;r.old=e;var n=this;this.startRequest(i);var a={};return a[i.name]=e,t.ajax(t.extend(!0,{url:s,mode:"abort",port:"validate"+i.name,dataType:"json",data:a,success:function(s){n.settings.messages[i.name].remote=r.originalMessage;var a=s===!0||"true"===s;if(a){var u=n.formSubmitted;n.prepareElement(i),n.formSubmitted=u,n.successList.push(i),delete n.invalid[i.name],n.showErrors()}else{var o={},l=s||n.defaultMessage(i,"remote");o[i.name]=r.message=t.isFunction(l)?l(e):l,n.invalid[i.name]=!0,n.showErrors(o)}r.valid=a,n.stopRequest(i,a)}},s)),"pending"}}}),t.format=t.validator.format})(jQuery),function(t){var e={};if(t.ajaxPrefilter)t.ajaxPrefilter(function(t,i,s){var r=t.port;"abort"===t.mode&&(e[r]&&e[r].abort(),e[r]=s)});else{var i=t.ajax;t.ajax=function(s){var r=("mode"in s?s:t.ajaxSettings).mode,n=("port"in s?s:t.ajaxSettings).port;return"abort"===r?(e[n]&&e[n].abort(),e[n]=i.apply(this,arguments),e[n]):i.apply(this,arguments)}}}(jQuery),function(t){t.extend(t.fn,{validateDelegate:function(e,i,s){return this.bind(i,function(i){var r=t(i.target);return r.is(e)?s.apply(r,arguments):void 0})}})}(jQuery);//'

/*!
 * iCheck v1.0.2, http://git.io/arlzeA
 * ===================================
 * Powerful jQuery and Zepto plugin for checkboxes and radio buttons customization
 *
 * (c) 2013 Damir Sultanov, http://fronteed.com
 * MIT Licensed
 */

(function($) {

	// Cached vars
	var _iCheck = 'iCheck',
		_iCheckHelper = _iCheck + '-helper',
		_checkbox = 'checkbox',
		_radio = 'radio',
		_checked = 'checked',
		_unchecked = 'un' + _checked,
		_disabled = 'disabled',
		_determinate = 'determinate',
		_indeterminate = 'in' + _determinate,
		_update = 'update',
		_type = 'type',
		_click = 'click',
		_touch = 'touchbegin.i touchend.i',
		_add = 'addClass',
		_remove = 'removeClass',
		_callback = 'trigger',
		_label = 'label',
		_cursor = 'cursor',
		_mobile = /ipad|iphone|ipod|android|blackberry|windows phone|opera mini|silk/i.test(navigator.userAgent);

	// Plugin init
	$.fn[_iCheck] = function(options, fire) {

		// Walker
		var handle = 'input[type="' + _checkbox + '"], input[type="' + _radio + '"]',
			stack = $(),
			walker = function(object) {
				object.each(function() {
					var self = $(this);

					if (self.is(handle)) {
						stack = stack.add(self);
					} else {
						stack = stack.add(self.find(handle));
					}
				});
			};

		// Check if we should operate with some method
		if (/^(check|uncheck|toggle|indeterminate|determinate|disable|enable|update|destroy)$/i.test(options)) {

			// Normalize method's name
			options = options.toLowerCase();

			// Find checkboxes and radio buttons
			walker(this);

			return stack.each(function() {
				var self = $(this);

				if (options == 'destroy') {
					tidy(self, 'ifDestroyed');
				} else {
					operate(self, true, options);
				}

				// Fire method's callback
				if ($.isFunction(fire)) {
					fire();
				}
			});

			// Customization
		} else if (typeof options == 'object' || !options) {

			// Check if any options were passed
			var settings = $.extend({
					checkedClass: _checked,
					disabledClass: _disabled,
					indeterminateClass: _indeterminate,
					labelHover: true
				}, options),

				selector = settings.handle,
				hoverClass = settings.hoverClass || 'hover',
				focusClass = settings.focusClass || 'focus',
				activeClass = settings.activeClass || 'active',
				labelHover = !!settings.labelHover,
				labelHoverClass = settings.labelHoverClass || 'hover',

			// Setup clickable area
				area = ('' + settings.increaseArea).replace('%', '') | 0;

			// Selector limit
			if (selector == _checkbox || selector == _radio) {
				handle = 'input[type="' + selector + '"]';
			}

			// Clickable area limit
			if (area < -50) {
				area = -50;
			}

			// Walk around the selector
			walker(this);

			return stack.each(function() {
				var self = $(this);

				// If already customized
				tidy(self);

				var node = this,
					id = node.id,

				// Layer styles
					offset = -area + '%',
					size = 100 + (area * 2) + '%',
					layer = {
						position: 'absolute',
						top: offset,
						left: offset,
						display: 'block',
						width: size,
						height: size,
						margin: 0,
						padding: 0,
						background: '#fff',
						border: 0,
						opacity: 0
					},

				// Choose how to hide input
					hide = _mobile ? {
						position: 'absolute',
						visibility: 'hidden'
					} : area ? layer : {
						position: 'absolute',
						opacity: 0
					},

				// Get proper class
					className = node[_type] == _checkbox ? settings.checkboxClass || 'i' + _checkbox : settings.radioClass || 'i' + _radio,

				// Find assigned labels
					label = $(_label + '[for="' + id + '"]').add(self.closest(_label)),

				// Check ARIA option
					aria = !!settings.aria,

				// Set ARIA placeholder
					ariaID = _iCheck + '-' + Math.random().toString(36).substr(2,6),

				// Parent & helper
					parent = '<div class="' + className + '" ' + (aria ? 'role="' + node[_type] + '" ' : ''),
					helper;

				// Set ARIA "labelledby"
				if (aria) {
					label.each(function() {
						parent += 'aria-labelledby="';

						if (this.id) {
							parent += this.id;
						} else {
							this.id = ariaID;
							parent += ariaID;
						}

						parent += '"';
					});
				}

				// Wrap input
				parent = self.wrap(parent + '/>')[_callback]('ifCreated').parent().append(settings.insert);

				// Layer addition
				helper = $('<ins class="' + _iCheckHelper + '"/>').css(layer).appendTo(parent);

				// Finalize customization
				self.data(_iCheck, {o: settings, s: self.attr('style')}).css(hide);
				!!settings.inheritClass && parent[_add](node.className || '');
				!!settings.inheritID && id && parent.attr('id', _iCheck + '-' + id);
				parent.css('position') == 'static' && parent.css('position', 'relative');
				operate(self, true, _update);

				// Label events
				if (label.length) {
					label.on(_click + '.i mouseover.i mouseout.i ' + _touch, function(event) {
						var type = event[_type],
							item = $(this);

						// Do nothing if input is disabled
						if (!node[_disabled]) {

							// Click
							if (type == _click) {
								if ($(event.target).is('a')) {
									return;
								}
								operate(self, false, true);

								// Hover state
							} else if (labelHover) {

								// mouseout|touchend
								if (/ut|nd/.test(type)) {
									parent[_remove](hoverClass);
									item[_remove](labelHoverClass);
								} else {
									parent[_add](hoverClass);
									item[_add](labelHoverClass);
								}
							}

							if (_mobile) {
								event.stopPropagation();
							} else {
								return false;
							}
						}
					});
				}

				// Input events
				self.on(_click + '.i focus.i blur.i keyup.i keydown.i keypress.i', function(event) {
					var type = event[_type],
						key = event.keyCode;

					// Click
					if (type == _click) {
						return false;

						// Keydown
					} else if (type == 'keydown' && key == 32) {
						if (!(node[_type] == _radio && node[_checked])) {
							if (node[_checked]) {
								off(self, _checked);
							} else {
								on(self, _checked);
							}
						}

						return false;

						// Keyup
					} else if (type == 'keyup' && node[_type] == _radio) {
						!node[_checked] && on(self, _checked);

						// Focus/blur
					} else if (/us|ur/.test(type)) {
						parent[type == 'blur' ? _remove : _add](focusClass);
					}
				});

				// Helper events
				helper.on(_click + ' mousedown mouseup mouseover mouseout ' + _touch, function(event) {
					var type = event[_type],

					// mousedown|mouseup
						toggle = /wn|up/.test(type) ? activeClass : hoverClass;

					// Do nothing if input is disabled
					if (!node[_disabled]) {

						// Click
						if (type == _click) {
							operate(self, false, true);

							// Active and hover states
						} else {

							// State is on
							if (/wn|er|in/.test(type)) {

								// mousedown|mouseover|touchbegin
								parent[_add](toggle);

								// State is off
							} else {
								parent[_remove](toggle + ' ' + activeClass);
							}

							// Label hover
							if (label.length && labelHover && toggle == hoverClass) {

								// mouseout|touchend
								label[/ut|nd/.test(type) ? _remove : _add](labelHoverClass);
							}
						}

						if (_mobile) {
							event.stopPropagation();
						} else {
							return false;
						}
					}
				});
			});
		} else {
			return this;
		}
	};

	// Do something with inputs
	function operate(input, direct, method) {
		var node = input[0],
			state = /er/.test(method) ? _indeterminate : /bl/.test(method) ? _disabled : _checked,
			active = method == _update ? {
				checked: node[_checked],
				disabled: node[_disabled],
				indeterminate: input.attr(_indeterminate) == 'true' || input.attr(_determinate) == 'false'
			} : node[state];

		// Check, disable or indeterminate
		if (/^(ch|di|in)/.test(method) && !active) {
			on(input, state);

			// Uncheck, enable or determinate
		} else if (/^(un|en|de)/.test(method) && active) {
			off(input, state);

			// Update
		} else if (method == _update) {

			// Handle states
			for (var each in active) {
				if (active[each]) {
					on(input, each, true);
				} else {
					off(input, each, true);
				}
			}

		} else if (!direct || method == 'toggle') {

			// Helper or label was clicked
			if (!direct) {
				input[_callback]('ifClicked');
			}

			// Toggle checked state
			if (active) {
				if (node[_type] !== _radio) {
					off(input, state);
				}
			} else {
				on(input, state);
			}
		}
	}

	// Add checked, disabled or indeterminate state
	function on(input, state, keep) {
		var node = input[0],
			parent = input.parent(),
			checked = state == _checked,
			indeterminate = state == _indeterminate,
			disabled = state == _disabled,
			callback = indeterminate ? _determinate : checked ? _unchecked : 'enabled',
			regular = option(input, callback + capitalize(node[_type])),
			specific = option(input, state + capitalize(node[_type]));

		// Prevent unnecessary actions
		if (node[state] !== true) {

			// Toggle assigned radio buttons
			if (!keep && state == _checked && node[_type] == _radio && node.name) {
				var form = input.closest('form'),
					inputs = 'input[name="' + node.name + '"]';

				inputs = form.length ? form.find(inputs) : $(inputs);

				inputs.each(function() {
					if (this !== node && $(this).data(_iCheck)) {
						off($(this), state);
					}
				});
			}

			// Indeterminate state
			if (indeterminate) {

				// Add indeterminate state
				node[state] = true;

				// Remove checked state
				if (node[_checked]) {
					off(input, _checked, 'force');
				}

				// Checked or disabled state
			} else {

				// Add checked or disabled state
				if (!keep) {
					node[state] = true;
				}

				// Remove indeterminate state
				if (checked && node[_indeterminate]) {
					off(input, _indeterminate, false);
				}
			}

			// Trigger callbacks
			callbacks(input, checked, state, keep);
		}

		// Add proper cursor
		if (node[_disabled] && !!option(input, _cursor, true)) {
			parent.find('.' + _iCheckHelper).css(_cursor, 'default');
		}

		// Add state class
		parent[_add](specific || option(input, state) || '');

		// Set ARIA attribute
		if (!!parent.attr('role') && !indeterminate) {
			parent.attr('aria-' + (disabled ? _disabled : _checked), 'true');
		}

		// Remove regular state class
		parent[_remove](regular || option(input, callback) || '');
	}

	// Remove checked, disabled or indeterminate state
	function off(input, state, keep) {
		var node = input[0],
			parent = input.parent(),
			checked = state == _checked,
			indeterminate = state == _indeterminate,
			disabled = state == _disabled,
			callback = indeterminate ? _determinate : checked ? _unchecked : 'enabled',
			regular = option(input, callback + capitalize(node[_type])),
			specific = option(input, state + capitalize(node[_type]));

		// Prevent unnecessary actions
		if (node[state] !== false) {

			// Toggle state
			if (indeterminate || !keep || keep == 'force') {
				node[state] = false;
			}

			// Trigger callbacks
			callbacks(input, checked, callback, keep);
		}

		// Add proper cursor
		if (!node[_disabled] && !!option(input, _cursor, true)) {
			parent.find('.' + _iCheckHelper).css(_cursor, 'pointer');
		}

		// Remove state class
		parent[_remove](specific || option(input, state) || '');

		// Set ARIA attribute
		if (!!parent.attr('role') && !indeterminate) {
			parent.attr('aria-' + (disabled ? _disabled : _checked), 'false');
		}

		// Add regular state class
		parent[_add](regular || option(input, callback) || '');
	}

	// Remove all traces
	function tidy(input, callback) {
		if (input.data(_iCheck)) {

			// Remove everything except input
			input.parent().html(input.attr('style', input.data(_iCheck).s || ''));

			// Callback
			if (callback) {
				input[_callback](callback);
			}

			// Unbind events
			input.off('.i').unwrap();
			$(_label + '[for="' + input[0].id + '"]').add(input.closest(_label)).off('.i');
		}
	}

	// Get some option
	function option(input, state, regular) {
		if (input.data(_iCheck)) {
			return input.data(_iCheck).o[state + (regular ? '' : 'Class')];
		}
	}

	// Capitalize some string
	function capitalize(string) {
		return string.charAt(0).toUpperCase() + string.slice(1);
	}

	// Executable handlers
	function callbacks(input, checked, callback, keep) {
		if (!keep) {
			if (checked) {
				input[_callback]('ifToggled');
			}

			input[_callback]('ifChanged')[_callback]('if' + capitalize(callback));
		}
	}
})(window.jQuery || window.Zepto);













