import axios from "axios";

const cognitoUrl = 'https://cognito-identity.eu-west-1.amazonaws.com/'
const edpURL = 'https://uiapi.emcp.edp.com'
export const login = async (userName, Password, loginApi) => {
    let data = JSON.stringify({
        "username": userName,
        "password": Password
    });

    let config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: loginApi + '/login',
        headers: {
            'Content-Type': 'application/json'
        },
        data: data
    };
    const response = await axios.request(config)
    return response.data;
}


export const getWSCredentials = async (tokenApi, IdentityId) => {
    let data = {
        "IdentityId": IdentityId,
        "Logins": {
            "cognito-idp.eu-west-1.amazonaws.com/eu-west-1_CZc7dNRRv": tokenApi
        }
    }

    let config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: cognitoUrl,
        headers: {
            'X-Amz-Target': 'AWSCognitoIdentityService.GetCredentialsForIdentity',
            'Content-Type': 'application/x-amz-json-1.1',
            'Accept': 'application/x-amz-json-1.1'
        },
        data: JSON.stringify(data)
    };

    const response = await axios.request(config)

    return response.data
}

export const getUser = async (id_token) => {

    let config = {
        method: 'get',
        maxBodyLength: Infinity,
        url: edpURL +'/usermanagement/user',
        headers: {
            'Accept': 'application/json',
            'Authorization': 'Bearer ' + id_token
        }
    };

    const response = await axios.request(config)
    return response.data

}

export const getDevices = async (id_token, house_id) => {

    let config = {
        method: 'get',
        maxBodyLength: Infinity,
        url: edpURL + '/equipment/houses/' + house_id + '/device',
        headers: {
            'Accept': 'application/json',
            'User-Agent': 'edpsolar-ios/1 CFNetwork/3860.100.1 Darwin/25.0.0',
            'Authorization': 'Bearer ' + id_token
        }
    };

    const response = await axios.request(config)
    return response.data
}

export const getHouses = async (id_token) => {

    let config = {
        method: 'get',
        maxBodyLength: Infinity,
        url: edpURL + '/equipment/houses',
        headers: {
            'Accept': 'application/json',
            'Authorization': 'Bearer ' + id_token
        }
    };
    const response = await axios.request(config)
    return response.data
}